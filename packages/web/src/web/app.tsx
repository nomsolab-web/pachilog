import { Route, Switch } from "wouter";
import Index from "./pages/index";
import ChannelPage from "./pages/channel";
import MachinesPage from "./pages/machines";
import MachinePage from "./pages/machine";
import WeeklyPage from "./pages/weekly";
import WeeklyDetailPage from "./pages/weekly-detail";
import AboutPage from "./pages/about";
import MethodologyPage from "./pages/methodology";
import PrivacyPage from "./pages/privacy";
import ContactPage from "./pages/contact";
import { Layout } from "./components/layout";
import { Provider } from "./components/provider";

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
          <Route path="/about" component={AboutPage} />
          <Route path="/methodology" component={MethodologyPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/contact" component={ContactPage} />
        </Switch>
      </Layout>
    </Provider>
  );
}

export default App;
