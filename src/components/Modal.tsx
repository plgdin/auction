import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  drawer?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      node.close();
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className={`modal ${wide ? "modal-wide" : ""} ${drawer ? "drawer" : ""}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-header">
          <span>{title}</span>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
