(ns metabase.query-processor.middleware.add-implicit-joins
  "Middleware that creates corresponding `:joins` for Tables referred to by `:field` clauses with `:source-field` info
  in the options and adds `:join-alias` info to those `:field` clauses."
  (:refer-clojure :exclude [alias])
  (:require
   [clojure.set :as set]
   [clojure.walk :as walk]
   [medley.core :as m]
   [metabase.driver :as driver]
   [metabase.driver.util :as driver.u]
   [metabase.legacy-mbql.schema :as mbql.s]
   [metabase.legacy-mbql.util :as mbql.u]
   [metabase.lib.join.util :as lib.join.u]
   [metabase.lib.metadata :as lib.metadata]
   [metabase.lib.metadata.protocols :as lib.metadata.protocols]
   [metabase.lib.schema.common :as lib.schema.common]
   [metabase.lib.schema.id :as lib.schema.id]
   [metabase.lib.util.match :as lib.util.match]
   [metabase.query-processor.error-type :as qp.error-type]
   [metabase.query-processor.middleware.add-implicit-clauses :as qp.add-implicit-clauses]
   [metabase.query-processor.store :as qp.store]
   [metabase.util.i18n :refer [tru]]
   [metabase.util.malli :as mu]))

(defn- implicitly-joined-fields
  "Find fields that come from implicit join in form `x`, presumably a query.
  Fields from metadata are not considered. It is expected, that field which would cause implicit join is in the query
  and not just in it's metadata. Example of query having `:source-field` fields in `:source-metadata` and no use of
  `:source-field` field in corresponding `:source-query` would be the one, that uses remappings. See
  [[metabase.parameters.custom-values-test/with-mbql-card-test]]."
  [x]
  (->> (lib.util.match/match x
         [:field _ (_ :guard (every-pred :source-field (complement :join-alias)))]
         (when-not (some #{:source-metadata} &parents)
           &match))
       distinct
       (into [])))

(defn- join-alias [dest-table-name source-fk-field-name source-fk-join-alias]
  (lib.join.u/format-implicit-join-name dest-table-name source-fk-field-name source-fk-join-alias))

(def ^:private FkFieldInfo
  [:map
   [:fk-field-id   ::lib.schema.id/field]
   [:fk-field-name {:optional true} [:maybe ::lib.schema.common/non-blank-string]]
   [:fk-join-alias {:optional true} [:maybe ::lib.schema.common/non-blank-string]]])

(def ^:private JoinInfo
  [:map
   [:source-table  ::lib.schema.id/table]
   [:alias         ::lib.schema.common/non-blank-string]
   [:fields        [:= :none]]
   [:strategy      [:= :left-join]]
   [:condition     mbql.s/=]
   [:fk-field-id   ::lib.schema.id/field]
   [:fk-field-name {:optional true} [:maybe ::lib.schema.common/non-blank-string]]
   [:fk-join-alias {:optional true} [:maybe ::lib.schema.common/non-blank-string]]])

(mu/defn- fk-field-infos->join-infos :- [:maybe [:sequential JoinInfo]]
  "Given `fk-field-infos`, return a sequence of maps containing IDs and and other info needed to generate corresponding
  `joined-field` and `:joins` clauses."
  [fk-field-infos :- [:maybe [:sequential FkFieldInfo]]]
  (when (seq fk-field-infos)
    (let [fk-field-ids       (into #{} (map :fk-field-id) fk-field-infos)
          fk-fields          (lib.metadata/bulk-metadata-or-throw (qp.store/metadata-provider) :metadata/column fk-field-ids)
          target-field-ids   (into #{} (keep :fk-target-field-id) fk-fields)
          target-fields      (when (seq target-field-ids)
                               (lib.metadata/bulk-metadata-or-throw (qp.store/metadata-provider) :metadata/column target-field-ids))
          target-table-ids   (into #{} (keep :table-id) target-fields)]
      ;; this is for cache-warming purposes.
      (when (seq target-table-ids)
        (lib.metadata/bulk-metadata-or-throw (qp.store/metadata-provider) :metadata/table target-table-ids))
      (for [{:keys [fk-field-id fk-field-name fk-join-alias]} fk-field-infos
            :let [fk-field (lib.metadata.protocols/field (qp.store/metadata-provider) fk-field-id)]
            :when fk-field
            :let [{pk-id :fk-target-field-id} fk-field]
            :when pk-id]
        (let [{source-table :table-id} (lib.metadata.protocols/field (qp.store/metadata-provider) pk-id)
              {table-name :name}       (lib.metadata.protocols/table (qp.store/metadata-provider) source-table)
              alias-for-join           (join-alias table-name (or fk-field-name (:name fk-field)) fk-join-alias)]
          (-> (m/assoc-some {:source-table        source-table
                             :qp/is-implicit-join true
                             :alias               alias-for-join
                             :fields              :none
                             :strategy            :left-join
                             :condition           [:= [:field
                                                       (or fk-field-name fk-field-id)
                                                       (m/assoc-some nil
                                                                     :base-type (when fk-field-name (:base-type fk-field))
                                                                     :join-alias fk-join-alias)]
                                                   [:field pk-id {:join-alias alias-for-join}]]
                             :fk-field-id         fk-field-id}
                            :fk-field-name fk-field-name
                            :fk-join-alias fk-join-alias)
              (vary-meta assoc ::needs [:field fk-field-id nil])))))))

(mu/defn- field-opts->fk-field-info :- FkFieldInfo
  "Create a [[FkFieldInfo]] map that identifies the corresponding implicit join.

  For backward compatibility with refs that don't include `:source-field-name` in cases when they should (cards), omit
  `:fk-field-name` when it matches the raw field name. There should be no difference in the compiled query. The
  problematic case is when refs with and without `:source-field-name` are mixed, but there should be the same implicit
  join for all of them."
  [{:keys [source-field source-field-name source-field-join-alias]}]
  (let [fk-field (lib.metadata.protocols/field (qp.store/metadata-provider) source-field)]
    (m/assoc-some {:fk-field-id source-field}
                  :fk-field-name (when (and (some? source-field-name) (not= source-field-name (:name fk-field)))
                                   source-field-name)
                  :fk-join-alias source-field-join-alias)))

(mu/defn- implicitly-joined-fields->joins :- [:sequential JoinInfo]
  "Create implicit join maps for a set of `field-clauses-with-source-field`."
  [field-clauses-with-source-field]
  (let [k-field-infos (->> field-clauses-with-source-field
                           (map (fn [clause]
                                  (lib.util.match/match-one clause
                                    [:field (id :guard integer?) (opts :guard (every-pred :source-field (complement :join-alias)))]
                                    (field-opts->fk-field-info opts))))
                           distinct
                           not-empty)]
    (->> (fk-field-infos->join-infos k-field-infos)
         distinct
         (into []))))

(defn- visible-joins
  "Set of all joins that are visible in the current level of the query or in a nested source query."
  [{:keys [source-query joins]}]
  (distinct
   (into joins
         (when source-query
           (visible-joins source-query)))))

(defn- distinct-fields [fields]
  (m/distinct-by
   (fn [field]
     (lib.util.match/replace (mbql.u/remove-namespaced-options field)
       [:field id-or-name (opts :guard map?)]
       [:field id-or-name (not-empty (dissoc opts :base-type :effective-type))]))
   fields))

(mu/defn- construct-fk-field-info->join-alias :- [:map-of
                                                  FkFieldInfo
                                                  ::lib.schema.common/non-blank-string]
  [form]
  ;; Build a map of [[FkFieldInfo]] -> alias used for IMPLICIT joins. Only implicit joins have `:fk-field-id`
  (into {}
        (keep (fn [{:keys [fk-field-id fk-field-name fk-join-alias], join-alias :alias}]
                (when fk-field-id
                  [(m/assoc-some {:fk-field-id fk-field-id}
                                 :fk-field-name fk-field-name
                                 :fk-join-alias fk-join-alias)
                   join-alias])))
        (visible-joins form)))

(defn- add-implicit-joins-aliases-to-metadata
  "Add `:join-alias`es to fields containing `:source-field` in `:source-metadata` of `query`.
  It is required, that `:source-query` has already it's joins resolved. It is valid, when no `:join-alias` could be
  found. For examaple during remaps, metadata contain fields with `:source-field`, that are not used further in their
  `:source-query`."
  [{:keys [source-query] :as query}]
  (let [fk-field-info->join-alias (construct-fk-field-info->join-alias source-query)]
    (update query :source-metadata
            #(lib.util.match/replace %
               [:field id-or-name (opts :guard (every-pred :source-field (complement :join-alias)))]
               (let [join-alias (fk-field-info->join-alias (field-opts->fk-field-info opts))]
                 (if (some? join-alias)
                   [:field id-or-name (assoc opts :join-alias join-alias)]
                   &match))))))

(defn- add-join-alias-to-fields-with-source-field
  "Add `:field` `:join-alias` to `:field` clauses with `:source-field` in `form`. Ignore `:source-metadata`."
  [form]
  (let [fk-field-info->join-alias (construct-fk-field-info->join-alias form)]
    (cond-> (lib.util.match/replace form
              [:field id-or-name (opts :guard (every-pred :source-field (complement :join-alias)))]
              (if-not (some #{:source-metadata} &parents)
                (let [join-alias (or (fk-field-info->join-alias (field-opts->fk-field-info opts))
                                     (throw (ex-info (tru "Cannot find matching FK Table ID for FK Field {0}"
                                                          (format "%s %s"
                                                                  (pr-str (:source-field opts))
                                                                  (let [field (lib.metadata/field
                                                                               (qp.store/metadata-provider)
                                                                               (:source-field opts))]
                                                                    (pr-str (:display-name field)))))
                                                     {:resolving  &match
                                                      :candidates fk-field-info->join-alias
                                                      :form       form})))]
                  [:field id-or-name (assoc opts :join-alias join-alias)])
                &match))
      (sequential? (:fields form)) (update :fields distinct-fields))))

(defn- already-has-join?
  "Whether the current query level already has a join with the same alias."
  [{:keys [joins source-query]} {join-alias :alias, :as join}]
  (or (some #(= (:alias %) join-alias)
            joins)
      (when source-query
        (recur source-query join))))

(defn- add-condition-fields-to-source
  "Add any fields that are needed for newly-added join conditions to source query `:fields` if they're not already
  present."
  [{{source-query-fields :fields} :source-query, :keys [joins], :as form}]
  (if (empty? source-query-fields)
    form
    (let [needed (set (filter some? (map (comp ::needs meta) joins)))]
      (update-in form [:source-query :fields] (fn [existing-fields]
                                                (distinct-fields (concat existing-fields needed)))))))

(defn- add-referenced-fields-to-source [form reused-joins]
  (let [reused-join-alias? (set (map :alias reused-joins))
        referenced-fields  (set (lib.util.match/match (dissoc form :source-query :joins)
                                  [:field _ (_ :guard (fn [{:keys [join-alias]}]
                                                        (reused-join-alias? join-alias)))]
                                  &match))]
    (update-in form [:source-query :fields] (fn [existing-fields]
                                              (distinct-fields
                                               (concat existing-fields referenced-fields))))))

(defn- add-fields-to-source
  [{{source-query-fields :fields, :as source-query} :source-query, :as form} reused-joins]
  (cond
    (not source-query)
    form

    (:native source-query)
    form

    (seq ((some-fn :aggregation :breakout) source-query))
    form

    :else
    (let [form (cond-> form
                 (empty? source-query-fields) (update :source-query qp.add-implicit-clauses/add-implicit-mbql-clauses))]
      (if (empty? (get-in form [:source-query :fields]))
        form
        (-> form
            add-condition-fields-to-source
            (add-referenced-fields-to-source reused-joins))))))

(defn- join-dependencies
  "Get a set of join aliases that `join` has an immediate dependency on."
  [join]
  (set
   (lib.util.match/match (:condition join)
     [:field _ (opts :guard :join-alias)]
     (let [{:keys [join-alias]} opts]
       (when-not (= join-alias (:alias join))
         join-alias)))))

(defn- topologically-sort-joins
  "Sort `joins` by topological dependency order: joins that are referenced by the `:condition` of another will be sorted
  first. If no dependencies exist between joins, preserve the existing order."
  [joins]
  (let [;; make a map of join alias -> immediate dependencies
        join->immediate-deps (into {}
                                   (map (fn [join]
                                          [(:alias join) (join-dependencies join)]))
                                   joins)
        ;; make a map of join alias -> immediate and transient dependencies
        all-deps             (fn all-deps [join-alias]
                               (let [immediate-deps (set (get join->immediate-deps join-alias))]
                                 (into immediate-deps
                                       (mapcat all-deps)
                                       immediate-deps)))
        join->all-deps       (into {}
                                   (map (fn [[join-alias]]
                                          [join-alias (all-deps join-alias)]))
                                   join->immediate-deps)
        ;; now we can create a function to decide if one join depends on another
        depends-on?          (fn [join-1 join-2]
                               (contains? (join->all-deps (:alias join-1))
                                          (:alias join-2)))]
    (->> joins
         ;; add a key to each join to record its original position
         (map-indexed (fn [i join]
                        (assoc join ::original-position i)))
         ;; sort the joins by topological order falling back to preserving original position
         (sort (fn [join-1 join-2]
                 (cond
                   (depends-on? join-1 join-2) 1
                   (depends-on? join-2 join-1) -1
                   :else                       (compare (::original-position join-1)
                                                        (::original-position join-2)))))
         ;; remove the keys we used to record original position
         (mapv (fn [join]
                 (dissoc join ::original-position))))))

(defn- resolve-implicit-joins-this-level
  "Add new `:joins` for tables referenced by `:field` forms with a `:source-field`. Add `:join-alias` info to those
  `:fields`. Add additional `:fields` to source query if needed to perform the join."
  [form]
  (let [implicitly-joined-fields (implicitly-joined-fields form)
        new-joins                (implicitly-joined-fields->joins implicitly-joined-fields)
        required-joins           (remove (partial already-has-join? form) new-joins)
        reused-joins             (set/difference (set new-joins) (set required-joins))]
    (cond-> form
      (seq required-joins) (update :joins (fn [existing-joins]
                                            (m/distinct-by
                                             :alias
                                             (concat existing-joins required-joins))))
      true                 add-join-alias-to-fields-with-source-field
      true                 (add-fields-to-source reused-joins)
      (seq required-joins) (update :joins topologically-sort-joins))))

(defn- resolve-implicit-joins [query]
  (let [has-source-query-and-metadata? (every-pred map? :source-query :source-metadata)
        query? (every-pred map? (some-fn :source-query :source-table) #(not (contains? % :condition)))]
    (walk/postwalk
     (fn [form]
       (cond-> form
         ;; `:source-metadata` of `:source-query` in this `form` are on this level. This `:source-query` has already
         ;;   its implicit joins resolved by `postwalk`. The following code updates its metadata too.
         (has-source-query-and-metadata? form)
         add-implicit-joins-aliases-to-metadata

         (query? form)
         resolve-implicit-joins-this-level))
     query)))

;;; +----------------------------------------------------------------------------------------------------------------+
;;; |                                                   Middleware                                                   |
;;; +----------------------------------------------------------------------------------------------------------------+

(defn add-implicit-joins
  "Fetch and store any Tables other than the source Table referred to by `:field` clauses with `:source-field` in an
  MBQL query, and add a `:join-tables` key inside the MBQL inner query containing information about the `JOIN`s (or
  equivalent) that need to be performed for these tables.

  This middleware also adds `:join-alias` info to all `:field` forms with `:source-field`s."
  [query]
  (if (lib.util.match/match-one (:query query) [:field _ (_ :guard (every-pred :source-field (complement :join-alias)))])
    (do
      (when-not (driver.u/supports? driver/*driver* :left-join (lib.metadata/database (qp.store/metadata-provider)))
        (throw (ex-info (tru "{0} driver does not support left join." driver/*driver*)
                        {:driver driver/*driver*
                         :type   qp.error-type/unsupported-feature})))
      (update query :query resolve-implicit-joins))
    query))
