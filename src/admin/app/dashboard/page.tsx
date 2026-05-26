/**
 * app/dashboard/page.tsx
 * Dashboard principal — stats + lista de videos + agregar nuevo
 */
import { Suspense } from 'react'
import { Stats } from '@/components/Stats'
import { VideoTable } from '@/components/VideoTable'
import { AddVideoForm } from '@/components/AddVideoForm'
import { Header } from '@/components/Header'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  return (
    <div className={styles.root}>
      <Header />

      <main className={styles.main}>
        {/* Stats overview */}
        <Suspense fallback={<StatsSkeleton />}>
          <Stats />
        </Suspense>

        {/* Content — tabs: Lista | Agregar */}
        <div className={styles.content}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${styles.tabActive}`}>
              Videos
            </button>
            <button className={styles.tab}>
              Agregar nuevo
            </button>
          </div>

          <div className={styles.panels}>
            {/* Panel: Lista de videos */}
            <section className={styles.panel}>
              <Suspense fallback={<VideoTableSkeleton />}>
                <VideoTable />
              </Suspense>
            </section>

            {/* Panel: Agregar video */}
            <section className={`${styles.panel} ${styles.panelHidden}`}>
              <AddVideoForm />
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Skeletons ──────────────────────────────────────
function StatsSkeleton() {
  return (
    <div className={styles.statsGrid}>
      {[...Array(4)].map((_, i) => (
        <div key={i} className={styles.statCard}>
          <div className={`skeleton ${styles.skeletonLabel}`} />
          <div className={`skeleton ${styles.skeletonValue}`} />
          <div className={`skeleton ${styles.skeletonSub}`} />
        </div>
      ))}
    </div>
  )
}

function VideoTableSkeleton() {
  return (
    <div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className={styles.skeletonRow}>
          <div className={`skeleton ${styles.skeletonThumb}`} />
          <div className={styles.skeletonMeta}>
            <div className={`skeleton ${styles.skeletonTitle}`} />
            <div className={`skeleton ${styles.skeletonSubtitle}`} />
          </div>
        </div>
      ))}
    </div>
  )
}