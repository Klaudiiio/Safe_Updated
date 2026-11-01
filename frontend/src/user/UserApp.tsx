import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Step1_Trigger } from "./components/Step1_Trigger";
import { Step2_Incident, type IncidentType } from "./components/Step2_Incident";
import { Step3_Report, type ReportData } from "./components/Step3_Report";
import { Step4_Recording } from "./components/Step4_Recording";
import { Step5_Sent } from "./components/Step5_Sent";

type Step = 1 | 2 | 3 | 4 | 5;

export default function UserApp() {
  const [step, setStep] = useState<Step>(1);
  const [selectedIncident, setSelectedIncident] = useState<IncidentType | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  const handleReset = () => {
    setStep(1);
    setSelectedIncident(null);
    setReportData(null);
  };

  return (
    <div
      className="min-h-screen h-screen overflow-hidden"
      style={{ background: "#080A0F", fontFamily: "Inter, sans-serif" }}
    >
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            className="size-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
          >
            <Step1_Trigger onActivate={() => setStep(2)} />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            className="size-full"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Step2_Incident
              onSelect={(incident) => {
                setSelectedIncident(incident);
                setStep(3);
              }}
              onBack={() => setStep(1)}
            />
          </motion.div>
        )}

        {step === 3 && selectedIncident && (
          <motion.div
            key="step3"
            className="size-full"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <Step3_Report
              incident={selectedIncident}
              onContinue={(data) => {
                setReportData(data);
                setStep(4);
              }}
              onBack={() => setStep(2)}
            />
          </motion.div>
        )}

        {step === 4 && selectedIncident && reportData && (
          <motion.div
            key="step4"
            className="size-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Step4_Recording
              incident={selectedIncident}
              onComplete={() => setStep(5)}
            />
          </motion.div>
        )}

        {step === 5 && selectedIncident && reportData && (
          <motion.div
            key="step5"
            className="size-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Step5_Sent
              incident={selectedIncident}
              onReset={handleReset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
