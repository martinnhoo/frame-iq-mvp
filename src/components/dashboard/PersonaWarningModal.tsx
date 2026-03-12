// Re-export PersonaGateModal as PersonaWarningModal for backward compat with NewBoard
import PersonaGateModal from "@/components/PersonaGateModal";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  toolName: string;
}

export function PersonaWarningModal({ open, onClose, onContinue }: Props) {
  return (
    <PersonaGateModal
      open={open}
      onClose={onClose}
      intent="board"
    />
  );
}
