// eslint-disable-next-line no-restricted-imports
import styled from "@emotion/styled";

import { CopyButton } from "metabase/common/components/CopyButton";

export const PasswordCopyButton = styled(CopyButton)`
  cursor: pointer;

  &:hover {
    color: var(--mb-color-brand);
  }
`;
