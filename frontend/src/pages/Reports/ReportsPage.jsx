import { useTranslation } from 'react-i18next'

export default function ReportsPage() {
  const { t } = useTranslation()
  return (
    <div className="page-header">
      <h1 className="page-title">{t('reports.title', 'Reports')}</h1>
    </div>
  )
}
