import { HashRouter, Route, Routes } from "react-router-dom";
import { LangProvider } from "./i18n";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { Build } from "./pages/Build";
import { Manage } from "./pages/Manage";
import { Admin } from "./pages/Admin";

export default function App() {
  return (
    <LangProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/build" element={<Build />} />
            <Route path="/manage/:secret" element={<Manage />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </Layout>
      </HashRouter>
    </LangProvider>
  );
}
