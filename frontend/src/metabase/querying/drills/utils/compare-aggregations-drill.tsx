import { t } from "ttag";

import { useDispatch } from "metabase/lib/redux";
import { setUIControls } from "metabase/query_builder/actions";
import {
  CompareAggregations,
  canAddTemporalCompareAggregation,
} from "metabase/query_builder/components/CompareAggregations";
import { trackColumnCompareViaColumnHeader } from "metabase/querying/analytics";
import type {
  ClickActionPopoverProps,
  Drill,
} from "metabase/visualizations/types/click-actions";
import * as Lib from "metabase-lib";

export const compareAggregationsDrill: Drill<
  Lib.CompareAggregationsDrillThruInfo
> = ({ drill, question, query, stageIndex, clicked }) => {
  if (!clicked.column || !canAddTemporalCompareAggregation(query, stageIndex)) {
    return [];
  }

  const { aggregation } = Lib.aggregationDrillDetails(drill);

  const DrillPopover = ({
    onChangeCardAndRun,
    onClose,
  }: ClickActionPopoverProps) => {
    const dispatch = useDispatch();

    return (
      <CompareAggregations
        aggregations={[aggregation]}
        query={query}
        stageIndex={stageIndex}
        onClose={onClose}
        onSubmit={(nextQuery, aggregations) => {
          const nextQuestion = question.setQuery(nextQuery);
          const nextCard = nextQuestion.card();

          trackColumnCompareViaColumnHeader(
            nextQuery,
            stageIndex,
            aggregations,
            nextQuestion.id(),
          );

          dispatch(setUIControls({ scrollToLastColumn: true }));
          onChangeCardAndRun({ nextCard });
          onClose();
        }}
      />
    );
  };

  return [
    {
      name: "compare-aggregations",
      title: t`Compare to the past`,
      section: "compare-aggregations",
      icon: "lines",
      buttonType: "horizontal",
      popover: DrillPopover,
    },
  ];
};
