import { useTranslation } from 'react-i18next'

export default function InvoicesPage() {
  const { t } = useTranslation()
  return (
    <div className="page-header">
      <h1 className="page-title">{t('invoices.title', 'Invoices')}</h1>
    </div>
  )
}
