import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  ArrowRight, 
  PieChart, 
  ShieldCheck, 
  Wallet, 
  LayoutDashboard 
} from 'lucide-react';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const steps: OnboardingStep[] = [
  {
    title: "Bienvenido a Control Financiero",
    description: "Tu plataforma inteligente para el seguimiento de cheques, facturas y flujo de caja en tiempo real.",
    icon: <LayoutDashboard className="w-12 h-12" />,
    color: "bg-blue-500"
  },
  {
    title: "Gestión de Cheques",
    description: "Registra, controla y supervisa el estado de tus cheques. Nunca pierdas de vista un vencimiento.",
    icon: <Wallet className="w-12 h-12" />,
    color: "bg-emerald-500"
  },
  {
    title: "Analítica Avanzada",
    description: "Visualiza la salud de tu negocio con gráficas detalladas y reportes personalizados de ingresos y egresos.",
    icon: <PieChart className="w-12 h-12" />,
    color: "bg-purple-500"
  },
  {
    title: "Seguridad Garantizada",
    description: "Tus datos están protegidos con encriptación de grado bancario y respaldos automáticos en la nube.",
    icon: <ShieldCheck className="w-12 h-12" />,
    color: "bg-amber-500"
  }
];

interface OnboardingTourProps {
  onFinish: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onFinish }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onFinish();
    }
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
      >
        <div className="relative h-48 flex items-center justify-center overflow-hidden">
          <div className={`absolute inset-0 ${step.color} opacity-10 transition-colors duration-500`} />
          <motion.div
            key={currentStep}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`p-6 rounded-2xl ${step.color} text-white shadow-lg`}
          >
            {step.icon}
          </motion.div>
          
          <div className="absolute top-4 right-6 flex gap-1">
            {steps.map((_, idx) => (
              <div 
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? 'w-6 bg-slate-800 dark:bg-white' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-8 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">
                {step.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>

          <button
            onClick={handleNext}
            className="w-full py-6 rounded-2xl text-lg font-semibold flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-lg active:scale-95"
          >
            {currentStep === steps.length - 1 ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                ¡Comenzar ahora!
              </>
            ) : (
              <>
                Siguiente
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          
          {currentStep === 0 && (
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              Estamos configurando tu espacio de trabajo personalizado...
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
