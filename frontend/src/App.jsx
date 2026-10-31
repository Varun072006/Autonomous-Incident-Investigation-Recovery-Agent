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
import Runs from './pages/Runs';
import Connectors from './pages/Connectors';
import Policies from './pages/Policies';
import Observability from './pages/Observability';
import Organization from './pages/Organization';
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

  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] text-slate-900 font-sans antialiased">
        {/* Left Control Plane Navigation */}
        <Sidebar llmStatus={llmStatus} />

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <Routes>
            <Route path="/" element={<Overview currentInvId={currentInvId} />} />
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
              path="/investigation"
              element={
                <Investigation 
                  currentInvId={currentInvId} 
                  setCurrentInvId={setCurrentInvId} 
                />
              }
            />
            <Route path="/runs" element={<Runs />} />
            <Route path="/recovery" element={<Recovery currentInvId={currentInvId} />} />
            <Route path="/agents" element={<Agents currentInvId={currentInvId} />} />
            <Route path="/evidence" element={<EvidenceExplorer currentInvId={currentInvId} />} />
            <Route path="/outages" element={<Connectors />} />
            <Route path="/connectors" element={<Connectors />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/observability" element={<Observability />} />
            <Route path="/organization" element={<Organization />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
