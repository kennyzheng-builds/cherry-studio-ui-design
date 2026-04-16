import { Agentation } from 'agentation';
import { CherryStudio } from './components/CherryStudio';

// Main App entry
export default function App() {
  return (
    <>
      <CherryStudio />
      {import.meta.env.DEV && <Agentation />}
    </>
  );
}
