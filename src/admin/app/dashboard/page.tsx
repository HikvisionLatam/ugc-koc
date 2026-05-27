import { Suspense } from 'react'
import Link from 'next/link'
import { Stats } from '@/components/Stats'
import { VideoTable } from '@/components/VideoTable'
import { AddVideoForm } from '@/components/AddVideoForm'
import { Header } from '@/components/Header'
import styles from './page.module.css'

export const dynamic = 'force-dynamic'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const activeTab = searchParams.tab === 'add' ? 'add' : 'videos'

  return (
    <div className={styles.root}>
      <Header />

      <main className={styles.main}>
        <Suspense fallback={<StatsSkeleton />}>
          <Stats />
        </Suspense>

        <div className={styles.content}>
          <div className={styles.tabs}>
            <Link
              href="/dashboard"
              className={`${styles.tab} ${activeTab === 'videos' ? styles.tabActive : ''}`}
            >
              Videos
            </Link>
            <Link
              href="/dashboard?tab=add"
              className={`${styles.tab} ${activeTab === 'add' ? styles.tabActive : ''}`}
            >
              Agregar video
            </Link>
          </div>

          <div className={styles.panels}>
            <div className={styles.panel}>
              {activeTab === 'videos' && (
                <Suspense fallback={<VideoTableSkeleton />}>
                  <VideoTable />
                </Suspense>
              )}
              {activeTab === 'add' && <AddVideoForm />}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

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
