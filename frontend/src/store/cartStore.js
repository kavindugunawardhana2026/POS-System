import { create } from 'zustand'
import api from '@/services/api'

export const useCartStore = create((set, get) => ({
  items: [],
  saleType: 'retail',
  discount: 0,
  customerId: null,

  setSaleType: (type) => set({ saleType: type }),
  setDiscount: (d) => set({ discount: d }),
  setCustomer: (id) => set({ customerId: id }),

  addItem: (product, quantity = 1) => {
    const { items, saleType } = get()
    const existing = items.find((i) => i.product_id === product.product_id)
    const unit_price =
      saleType === 'wholesale' && product.wholesale_price ? product.wholesale_price : product.retail_price

    if (existing) {
      set({
        items: items.map((i) =>
          i.product_id === product.product_id
            ? { ...i, quantity: i.quantity + quantity, subtotal: (i.quantity + quantity) * unit_price }
            : i
        ),
      })
    } else {
      set({
        items: [...items, {
          product_id: product.product_id,
          name: product.name,
          sku: product.sku,
          unit_price,
          quantity,
          discount: 0,
          subtotal: quantity * unit_price,
        }],
      })
    }
  },

  updateQuantity: (product_id, quantity) => {
    if (quantity <= 0) return get().removeItem(product_id)
    set({
      items: get().items.map((i) =>
        i.product_id === product_id
          ? { ...i, quantity, subtotal: quantity * i.unit_price - i.discount }
          : i
      ),
    })
  },

  removeItem: (product_id) =>
    set({ items: get().items.filter((i) => i.product_id !== product_id) }),

  clearCart: () => set({ items: [], discount: 0, customerId: null }),

  get subtotal() {
    return get().items.reduce((s, i) => s + i.subtotal, 0)
  },

  get total() {
    return Math.max(0, get().items.reduce((s, i) => s + i.subtotal, 0) - get().discount)
  },
}))
