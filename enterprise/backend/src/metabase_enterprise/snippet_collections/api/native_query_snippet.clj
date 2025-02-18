(ns metabase-enterprise.snippet-collections.api.native-query-snippet
  (:require
   [metabase.premium-features.core :refer [defenterprise]]
   [metabase.util.honey-sql-2 :as h2x]))

(defenterprise snippets-collection-filter-clause
  "Clause to filter out snippet collections from the collection query on OSS instances, and instances without the
  snippet-collections feature flag. EE implementation returns `nil`, so as to not filter out snippet collections."
  :feature :snippet-collections
  [])

(defenterprise snippets-collection-children-query
  "Collection children query for snippets on EE."
  :feature :snippet-collections
  [collection {:keys [archived?]}]
  {:select [:id :collection_id :name :entity_id [(h2x/literal "snippet") :model]]
   :from   [[:native_query_snippet :nqs]]
   :where  [:and
            [:= :collection_id (:id collection)]
            [:= :archived (boolean archived?)]]})
