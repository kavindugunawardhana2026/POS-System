import { useTranslation } from 'react-i18next'

export default function PurchasesPage() {
  const { t } = useTranslation()
  return (
    <div className="page-header">
      <h1 className="page-title">{t('purchases.title', 'Purchases')}</h1>
    </div>
  )
}
