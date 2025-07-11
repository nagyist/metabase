import { Route } from "react-router";

import { renderWithProviders, screen } from "__support__/ui";
import { AdminPeopleApp } from "metabase/admin/people/containers/AdminPeopleApp";
import {
  createMockTokenFeatures,
  createMockUser,
} from "metabase-types/api/mocks";
import {
  createMockSettingsState,
  createMockState,
} from "metabase-types/store/mocks";
interface SetupOpts {
  activeUsersCount: number;
  ssoEnabled: boolean;
  isSuperUser: boolean;
}

const setup = ({ activeUsersCount, ssoEnabled, isSuperUser }: SetupOpts) => {
  const state = createMockState({
    currentUser: createMockUser({
      is_superuser: isSuperUser,
    }),
    settings: createMockSettingsState({
      "active-users-count": activeUsersCount,
      "token-features": createMockTokenFeatures({
        sso_saml: ssoEnabled,
      }),
    }),
  });

  renderWithProviders(
    <Route path="*" component={() => <AdminPeopleApp>empty</AdminPeopleApp>} />,
    {
      storeInitialState: state,
      withRouter: true,
      initialRoute: "/admin/people",
    },
  );
};

describe("AdminPeopleApp", () => {
  describe("nudge to pro", () => {
    const nudgeText = /tired of manually managing people/i;
    const setupOpts = {
      activeUsersCount: 50,
      ssoEnabled: false,
      isSuperUser: true,
    };

    it("should be visible when user is admin, has 50 active users, and SSO is not available", () => {
      setup(setupOpts);
      expect(screen.getByText(nudgeText)).toBeInTheDocument();
      const link = screen.getByRole("link", { name: /try metabase pro/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        "href",
        expect.stringMatching(/^https:\/\/www.metabase.com\/upgrade/),
      );
    });

    it("should not be visible with less than 50 users", () => {
      setup({ ...setupOpts, activeUsersCount: 10 });
      expect(screen.queryByText(nudgeText)).not.toBeInTheDocument();
    });

    it("should not be visible when user is not admin", () => {
      setup({ ...setupOpts, isSuperUser: false });
      expect(screen.queryByText(nudgeText)).not.toBeInTheDocument();
    });

    it("should not be visible when SSO is already available", () => {
      setup({ ...setupOpts, ssoEnabled: true });
      expect(screen.queryByText(nudgeText)).not.toBeInTheDocument();
    });
  });
});
