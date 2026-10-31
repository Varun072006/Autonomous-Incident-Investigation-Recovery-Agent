import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import PlanAndRun from './pages/PlanAndRun';
import WorkflowCanvasPage from './pages/WorkflowCanvasPage';
import Agents from './pages/Agents';
import Overview from './pages/Overview';
import Investigation from './pages/Investigation';
import EvidenceExplorer from './pages/EvidenceExplorer';
import Recovery from './pages/Recovery';
import { api } from './api';

export default function App() {
  const [currentInvId, setCurrentInvId] = useState('');
  const [llmStatus, setLlmStatus] = useState(null);

  // Initialize or fetch active investigation
  useEffect(() => {
    api.createInvestigation()
      .then(inv => {
        setCurrentInvId(inv.id);
        // Run initial step 0 intake
        api.stepInvestigation(inv.id).catch(() => {});
      })
      .catch(err => {
        console.warn("Backend connecting...", err);
      });

    api.getLlmStatus()
      .then(setLlmStatus)
      .catch(() => {});
  }, []);

  const handleReset = async () => {
    try {
      await api.resetDatabase();
      const inv = await api.createInvestigation();
      setCurrentInvId(inv.id);
      await api.stepInvestigation(inv.id);
    } catch (err) {
      console.error("Reset failed:", err);
    }
  };

  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] text-slate-900 font-sans antialiased">
        {/* Left Control Plane Navigation matching HAC-FEW / Agent Control Plane */}
        <Sidebar llmStatus={llmStatus} />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route
              path="/plan-and-run"
              element={
                <PlanAndRun 
                  currentInvId={currentInvId} 
                  setCurrentInvId={setCurrentInvId} 
                />
              }
            />
            <Route
              path="/workflow-canvas"
              element={
                <WorkflowCanvasPage 
                  currentInvId={currentInvId} 
                  setCurrentInvId={setCurrentInvId} 
                />
              }
            />
            <Route
              path="/agents"
              element={
                <Agents currentInvId={currentInvId} />
              }
            />
            <Route
              path="/investigation"
              element={
                <Investigation 
                  currentInvId={currentInvId} 
                  setCurrentInvId={setCurrentInvId} 
                />
              }
            />
            <Route
              path="/evidence"
              element={<EvidenceExplorer currentInvId={currentInvId} />}
            />
            <Route
              path="/recovery"
              element={<Recovery currentInvId={currentInvId} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
