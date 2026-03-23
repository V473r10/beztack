import type { MembershipTier } from "@/types/membership"

export type PaymentProvider = "polar" | "mercadopago"

export type Product = {
	id: string
	name: string
	description?: string
	price: {
		amount: number
		currency: string
	}
	interval: "month" | "year" | "day" | "week"
	intervalCount: number
	metadata?: Record<string, unknown>
}

export type Subscription = {
	id: string
	status:
		| "active"
		| "inactive"
		| "pending"
		| "canceled"
		| "paused"
		| "past_due"
	productId: string
	productName?: string
	customerId?: string
	customerEmail?: string
	currentPeriodStart?: Date
	currentPeriodEnd?: Date
	cancelAtPeriodEnd?: boolean
	metadata?: Record<string, unknown>
	createdAt?: string | Date
}

export type Order = {
	id: string
	status: string
	totalAmount: number
	metadata?: Record<string, unknown>
	createdAt?: string | Date
}

export type CustomerMeter = {
	id: string
	name: string
	value: number
	limit?: number
}

export type CatalogPlan = {
	id: string
	canonicalTierId: MembershipTier | null
	displayName: string
	description: string | null
	features: string[]
	limits: Record<string, number>
	permissions: string[]
	price: { amount: number; currency: string }
	frequency: number
	frequencyType: string
	initPoint: string | null
	highlighted: boolean
	visible: boolean
	displayOrder: number | null
}

export type ProductsResponse = {
	provider: PaymentProvider
	products: Product[]
	plans?: CatalogPlan[]
}

export type SubscriptionsResponse = {
	provider: PaymentProvider
	subscriptions: Subscription[]
}
