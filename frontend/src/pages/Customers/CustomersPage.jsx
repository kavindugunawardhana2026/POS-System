import { useTranslation } from 'react-i18next'

export default function CustomersPage() {
  const { t } = useTranslation()
  return (
    <div className="page-header">
      <h1 className="page-title">{t('customers.title', 'Customers')}</h1>
    </div>
  )
}
