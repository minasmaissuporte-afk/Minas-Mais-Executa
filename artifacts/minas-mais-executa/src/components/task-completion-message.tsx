import { CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';

export function TaskCompletionMessage({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
    <DialogContent className="task-completion-message" data-testid="task-completion-message">
      <CheckCircle2 size={40} className="task-completion-message-icon" aria-hidden="true" />
      <DialogTitle>Muito obrigado pela conclusão da tarefa!</DialogTitle>
      <DialogDescription asChild>
        <div className="task-completion-message-copy">
          <p>E não se esqueça: nada é tão bom que não possa melhorar!</p>
          <p><strong>Você é um líder de excelência!</strong></p>
        </div>
      </DialogDescription>
      <DialogFooter>
        <button type="button" className="button button-success" onClick={onClose} data-testid="button-close-completion-message">Continuar</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
