import { Route, Switch } from "wouter";
import Index from "./pages/index";
import ChannelPage from "./pages/channel";
import MachinesPage from "./pages/machines";
import MachinePage from "./pages/machine";
import WeeklyPage from "./pages/weekly";
import WeeklyDetailPage from "./pages/weekly-detail";
import { Layout } from "./components/layout";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <Layout>
        <Switch>
          <Route path="/" component={Index} />
          <Route path="/channels/:id" component={ChannelPage} />
          <Route path="/machines" component={MachinesPage} />
          <Route path="/machines/:id" component={MachinePage} />
          <Route path="/weekly" component={WeeklyPage} />
          <Route path="/weekly/:weekOf" component={WeeklyDetailPage} />
        </Switch>
      </Layout>
      {import.meta.env.DEV && <AgentFeedback />}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
