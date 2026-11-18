'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SlideTabs } from '@/components/ui/slide-tabs';
import BottomNavBar from '@/components/ui/bottom-nav-bar';
import {
	Drawer,
	DrawerBody,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from '@/components/ui/drawer';
import { 
	Minus, 
	Plus, 
	ShoppingCart,
	Trash2,
} from 'lucide-react';


export default function ShoppingCartDrawer() {
	const [cartItems, setCartItems] = React.useState([
		{
			id: 1,
			name: 'Headphones',
			price: 79.99,
			quantity: 1,
			image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&auto=format&fit=crop&q=80'
		},
		{
			id: 3,
			name: 'Phone Case',
			price: 24.99,
			quantity: 1,
			image: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=200&auto=format&fit=crop&q=80'
		}
	]);

	const updateQuantity = (id: number, newQuantity: number) => {
		if (newQuantity === 0) {
			setCartItems(prev => prev.filter(item => item.id !== id));
		} else {
			setCartItems(prev =>
				prev.map(item =>
					item.id === id ? { ...item, quantity: newQuantity } : item
				)
			);
		}
	};

	const removeItem = (id: number) => {
		setCartItems(prev => prev.filter(item => item.id !== id));
	};

	const getTotalPrice = () => {
		return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
	};

	const getTotalItems = () => {
		return cartItems.reduce((total, item) => total + item.quantity, 0);
	};

	return (
		<Drawer>
			<DrawerTrigger asChild>
				<Button variant="outline" className="relative">
					<ShoppingCart className="w-4 h-4 mr-2" />
					Shopping Cart
					{cartItems.length > 0 && (
						<span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
							{getTotalItems()}
						</span>
					)}
				</Button>
			</DrawerTrigger>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle className="flex items-center gap-2">
						<ShoppingCart className="w-5 h-5" />
						Shopping Cart ({getTotalItems()} items)
					</DrawerTitle>
					<DrawerDescription>
						Review your items before checkout.
					</DrawerDescription>
				</DrawerHeader>
				<DrawerBody className="max-h-[60vh] overflow-y-auto">
					{cartItems.length === 0 ? (
						<div className="text-center py-8">
							<ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
							<p className="text-gray-500 mb-4">Your cart is empty</p>
							<Button variant="outline">Continue Shopping</Button>
						</div>
					) : (
						<div className="space-y-4">
							{cartItems.map((item) => (
								<div key={item.id} className="flex items-center gap-4 p-4 border rounded-lg">
									<img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
									<div className="flex-1">
										<h3 className="font-medium">{item.name}</h3>
										<p className="text-sm text-gray-500">${item.price.toFixed(2)} each</p>
									</div>
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="icon"
											className="h-8 w-8"
											onClick={() => updateQuantity(item.id, item.quantity - 1)}
										>
											<Minus className="w-3 h-3" />
										</Button>
										<span className="w-8 text-center text-sm">{item.quantity}</span>
										<Button
											variant="outline"
											size="icon"
											className="h-8 w-8"
											onClick={() => updateQuantity(item.id, item.quantity + 1)}
										>
											<Plus className="w-3 h-3" />
										</Button>
									</div>
									<div className="text-right">
										<p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
										<Button
											variant="outline"
											size="sm"
											className="text-red-600 hover:bg-red-50 mt-1"
											onClick={() => removeItem(item.id)}
										>
											<Trash2 className="w-3 h-3" />
										</Button>
									</div>
								</div>
							))}
							
							{/* Order Summary */}
							<div className="border-t pt-4 mt-6">
								<div className="space-y-2">
									<div className="flex justify-between text-sm">
										<span>Subtotal:</span>
										<span>${getTotalPrice().toFixed(2)}</span>
									</div>
									<div className="flex justify-between text-sm">
										<span>Shipping:</span>
										<span>$5.99</span>
									</div>
									<div className="flex justify-between text-sm">
										<span>Tax:</span>
										<span>${(getTotalPrice() * 0.08).toFixed(2)}</span>
									</div>
									<div className="border-t pt-2 flex justify-between font-medium">
										<span>Total:</span>
										<span>${(getTotalPrice() + 5.99 + (getTotalPrice() * 0.08)).toFixed(2)}</span>
									</div>
								</div>
							</div>

							{/* Promo Code */}
							<div className="border-t pt-4">
								<div className="flex gap-2">
									<Input placeholder="Promo code" className="flex-1" />
									<Button variant="outline">Apply</Button>
								</div>
							</div>
						</div>
					)}
				</DrawerBody>
				<DrawerFooter className="grid-cols-2">
					<DrawerClose asChild>
						<Button variant="outline" className="w-full">
							Continue Shopping
						</Button>
					</DrawerClose>
					<Button 
						className="w-full"
						disabled={cartItems.length === 0}
						onClick={() => alert('Proceeding to checkout...')}
					>
						Checkout (${(getTotalPrice() + 5.99 + (getTotalPrice() * 0.08)).toFixed(2)})
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}

export function SlideTabsDemo() {
	return (
		<div className="w-full grid min-h-[300px] place-content-center bg-[#FAF4EB]">
			<SlideTabs />
		</div>
	);
}

export function BottomNavBarDemo() {
	return (
		<div className="w-full grid min-h-[200px] place-content-center bg-[#FAF7F2] p-8">
			<BottomNavBar />
		</div>
	);
}

export { SlideTabsDemo as DemoOne, BottomNavBarDemo as Demo };
