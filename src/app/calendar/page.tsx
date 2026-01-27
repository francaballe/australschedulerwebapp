"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import CalendarComponent from "@/components/CalendarComponent";
import styles from "./page.module.css";

export default function CalendarPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

  return (
    <div className={styles.wrapper}>
      <Navbar />
      <div className={styles.content}>
        <Sidebar />
        <main className={styles.main}>
          <div className={styles.header}>
            <h1>Planificación de Turnos</h1>
            <p>Gestiona los horarios y asignaciones del equipo</p>
          </div>

          {loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
            </div>
          )}

          <CalendarComponent />
        </main>
      </div>
    </div>
  );
}