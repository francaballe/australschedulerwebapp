"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import CalendarComponent from "@/components/CalendarComponent";
import styles from "./page.module.css";
import modalStyles from "./modal.module.css";

interface Position {
  id: string | number;
  name: string;
  color: string;
  checked: boolean;
}

export default function CalendarPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishType, setPublishType] = useState<'all' | 'changes'>('all');
  const [publishLoading, setPublishLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [newPositionName, setNewPositionName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  if (!user) return null;

  const openPublish = (type: 'all' | 'changes') => {
    setPublishType(type);
    setPublishModalOpen(true);
  };

  const confirmPublish = async () => {
    setPublishLoading(true);
    try {
      const today = new Date();
      const sunday = new Date(today);
      sunday.setDate(today.getDate() - today.getDay());
      const end = new Date(sunday);
      end.setDate(sunday.getDate() + 6);

      const startDate = sunday.toISOString().split('T')[0];
      const endDate = end.toISOString().split('T')[0];

      const resp = await fetch('/api/shifts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, type: publishType })
      });

      if (!resp.ok) throw new Error('Error al publicar');

      // Notify calendar to refresh
      try { window.dispatchEvent(new Event('publishedShifts')); } catch { }
      setPublishModalOpen(false);
    } catch (err) {
      console.error('Publish failed', err);
      alert('Error al publicar. Revisa la consola.');
    } finally {
      setPublishLoading(false);
    }
  };

  const handleEditPosition = (position: Position) => {
    setEditingPosition(position);
    setNewPositionName(position.name);
    setEditModalOpen(true);
  };

  const confirmEditPosition = async () => {
    if (!editingPosition || !newPositionName.trim()) return;

    setEditLoading(true);
    try {
      const response = await fetch(`/api/positions/${editingPosition.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newPositionName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar la posición');
      }

      // Notify sidebar to refresh positions list
      window.dispatchEvent(new CustomEvent('positionsUpdated', {
        detail: { positionId: editingPosition.id, name: newPositionName.trim() }
      }));

      setEditModalOpen(false);
      setEditingPosition(null);
      setNewPositionName('');
    } catch (err) {
      console.error('Edit position failed', err);
      alert('Error al actualizar el nombre de la posición. Revisa la consola.');
    } finally {
      setEditLoading(false);
    }
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingPosition(null);
    setNewPositionName('');
  };

  return (
    <div className={styles.wrapper}>
      <Navbar />
      <div className={styles.content}>
        <Sidebar 
          onPublishAll={() => openPublish('all')} 
          onPublishChanges={() => openPublish('changes')} 
          onEditPosition={handleEditPosition}
        />
        <main className={styles.main}>


          {loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
            </div>
          )}

          <CalendarComponent />
        </main>
      </div>

      {/* Publish confirmation modal copied legend from old app */}
      {publishModalOpen && (
        <div className={modalStyles.modalOverlay} onClick={() => setPublishModalOpen(false)}>
          <div className={modalStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={modalStyles.modalHeader}>
              <h3>{publishType === 'all' ? 'Publicar Todo' : 'Publicar Sólo Cambios'}</h3>
              <button className={modalStyles.modalCloseButton} onClick={() => setPublishModalOpen(false)}>×</button>
            </div>
            <div className={modalStyles.modalBody}>
              <p>
                {publishType === 'all'
                  ? 'Está seguro de que desea publicar todos los turnos?'
                  : 'Está seguro de que desea publicar sólo los turnos que han sufrido cambios?'}
              </p>
            </div>
            <div className={modalStyles.modalFooter}>
              <button className={modalStyles.modalCancelButton} onClick={() => setPublishModalOpen(false)} disabled={publishLoading}>Cancelar</button>
              <button className={modalStyles.primaryBtn} onClick={confirmPublish} disabled={publishLoading}>{publishLoading ? 'Publicando...' : 'Publicar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Position modal */}
      {editModalOpen && editingPosition && (
        <div className={modalStyles.modalOverlay} onClick={closeEditModal}>
          <div className={modalStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={modalStyles.modalHeader}>
              <h3>Editar Posición</h3>
              <button className={modalStyles.modalCloseButton} onClick={closeEditModal}>×</button>
            </div>
            <div className={modalStyles.modalBody}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Nombre de la posición:
                </label>
                <input
                  type="text"
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  placeholder="Ingrese el nombre de la posición"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !editLoading && newPositionName.trim()) {
                      confirmEditPosition();
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div className={modalStyles.modalFooter}>
              <button 
                className={modalStyles.modalCancelButton} 
                onClick={closeEditModal} 
                disabled={editLoading}
              >
                Cancelar
              </button>
              <button 
                className={modalStyles.primaryBtn} 
                onClick={confirmEditPosition} 
                disabled={editLoading || !newPositionName.trim()}
              >
                {editLoading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}