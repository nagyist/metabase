import styled from "@emotion/styled";

import {
  HoverParent,
  QueryColumnInfoIcon,
} from "metabase/components/MetadataInfo/ColumnInfoIcon";

export const ItemTitle = styled.div`
  min-width: 10ch;
`;

export const ItemIcon = styled(QueryColumnInfoIcon)`
  margin: 0 0.5em;
  margin-left: 0.75em;
  color: var(--mb-color-text-light);
`;

export const ItemList = styled.ul`
  padding: 0.5em;
`;

export const ToggleItem = styled.li`
  border-bottom: 1px solid var(--mb-color-border);
  margin-bottom: 0.5em;

  ${ItemTitle} {
    margin-left: 1em;
  }
`;

export const Label = styled(HoverParent)`
  display: flex;
  align-items: center;
  padding: 0 0.5em;
  padding-right: 0;
  border-radius: 6px;
  cursor: pointer;
  min-height: 2.25rem;

  &:hover {
    background: var(--mb-color-bg-medium);
  }
`;
