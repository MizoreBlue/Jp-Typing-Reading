import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ImportPage from "@/pages/ImportPage";
import AlignPage from "@/pages/AlignPage";
import TXTMatchPage from "@/pages/TXTMatchPage";
import ReaderPage from "@/pages/ReaderPage";
import VocabPage from "@/pages/VocabPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ImportPage />} />
        <Route path="/align" element={<AlignPage />} />
        <Route path="/txt-match" element={<TXTMatchPage />} />
        <Route path="/read" element={<ReaderPage />} />
        <Route path="/vocab" element={<VocabPage />} />
      </Routes>
    </Router>
  );
}
