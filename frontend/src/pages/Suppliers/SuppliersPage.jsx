import { useTranslation } from 'react-i18next'

export default function SuppliersPage() {
  const { t } = useTranslation()
  return (
    <div className="page-header">
      <h1 className="page-title">{t('suppliers.title', 'Suppliers')}</h1>
    </div>
  )
}
