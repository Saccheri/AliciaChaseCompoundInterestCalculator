import { Shell } from "./components/Shell";
import { SimulationProvider } from "./state/SimulationContext";

export default function App() {
  return (
    <SimulationProvider>
      <Shell />
    </SimulationProvider>
  );
}
