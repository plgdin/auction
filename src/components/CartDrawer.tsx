"use client";

import { ArrowRight, LockKeyhole, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useStore } from "../lib/store";
import { formatMoney } from "../lib/format";
import { BUYER_PLATFORM_FEE_PAISE } from "../lib/sellerMath";
import { Link } from "./Link";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SERIF_FONT = '"DM Serif Display", Georgia, serif';
const SANS_FONT = '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { cart, cartSubtotal, setCartQuantity, removeFromCart } = useStore();
  const total = cartSubtotal + (cart.length > 0 ? BUYER_PLATFORM_FEE_PAISE : 0);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent
        style={{ fontFamily: SANS_FONT }}
        className="max-w-[420px] mx-auto bg-[#FAF7F2] border-t border-x border-[#e4d7c7] rounded-t-[28px] text-[#3a2816] shadow-2xl p-0 overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <DrawerHeader className="flex flex-row items-start justify-between border-b border-[#ebdcca] px-5 pt-1 pb-3.5">
          <div className="flex flex-col text-left gap-1">
            <DrawerDescription
              style={{ fontFamily: SANS_FONT }}
              className="text-[11px] uppercase tracking-wider text-[#8a7261] font-semibold"
            >
              Your shortlist
            </DrawerDescription>
            <DrawerTitle
              style={{ fontFamily: SERIF_FONT }}
              className="text-2xl sm:text-[26px] font-normal text-[#3a2816] tracking-tight leading-none"
            >
              Your cart <em style={{ fontFamily: SERIF_FONT }} className="italic text-[#705335]">so far.</em>
            </DrawerTitle>
          </div>
          <DrawerClose asChild>
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-full border border-[#493022]/20 text-[#493022] hover:bg-[#493022]/10 transition-colors cursor-pointer"
              aria-label="Close cart"
            >
              <X size={16} />
            </button>
          </DrawerClose>
        </DrawerHeader>

        {/* Scrollable body with browser slider/scrollbar hidden */}
        <DrawerBody className="max-h-[55vh] overflow-y-auto px-5 py-3 space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cart.length > 0 ? (
            <>
              <div className="space-y-2.5">
                {cart.map(({ product, line }) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white/85 border border-[#e8dfd3] shadow-[0_1px_3px_rgba(73,48,34,0.04)]"
                  >
                    <Link
                      href={`#/product/${product.id}`}
                      onClick={onClose}
                      className="shrink-0"
                    >
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="w-12 h-14 object-cover rounded-lg border border-[#e8dfd3]"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`#/product/${product.id}`}
                        onClick={onClose}
                        style={{ fontFamily: SANS_FONT }}
                        className="font-medium text-xs sm:text-sm text-[#2e1c12] truncate block hover:underline"
                      >
                        {product.title}
                      </Link>
                      <div
                        style={{ fontFamily: SANS_FONT }}
                        className="text-[11px] text-[#8a7261] mt-0.5"
                      >
                        {product.condition} · Qty {line.quantity}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="inline-flex items-center rounded-md border border-[#d8cbbe] bg-[#FAF7F2] h-6">
                          <button
                            type="button"
                            onClick={() => setCartQuantity(product.id, line.quantity - 1)}
                            className="px-1.5 h-full hover:bg-[#e8dfd3] rounded-l-md text-[#5c3e29] transition-colors flex items-center justify-center cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={11} />
                          </button>
                          <span
                            style={{ fontFamily: SANS_FONT }}
                            className="px-1.5 text-[11px] font-semibold tabular-nums text-[#3a2816]"
                          >
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCartQuantity(product.id, line.quantity + 1)}
                            className="px-1.5 h-full hover:bg-[#e8dfd3] rounded-r-md text-[#5c3e29] transition-colors flex items-center justify-center cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(product.id)}
                          className="text-[#994d3a] hover:text-[#732918] p-1 transition-colors cursor-pointer"
                          title="Remove item"
                          aria-label={`Remove ${product.title}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        style={{
                          fontFamily: SERIF_FONT,
                          fontVariantNumeric: "lining-nums tabular-nums",
                        }}
                        className="text-base sm:text-[17px] font-normal text-[#2e1c12] tracking-tight"
                      >
                        {formatMoney(product.askingPrice * line.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{ fontFamily: SANS_FONT }}
                className="border-t border-[#ebdcca] pt-2.5 space-y-1.5 text-xs text-[#5c3e29]"
              >
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <strong className="font-semibold text-[#2e1c12] tabular-nums">
                    {formatMoney(cartSubtotal)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee</span>
                  <strong className="font-semibold text-[#2e1c12] tabular-nums">
                    {formatMoney(BUYER_PLATFORM_FEE_PAISE)}
                  </strong>
                </div>
                <div className="flex justify-between items-baseline border-t border-[#ebdcca] pt-2 text-sm">
                  <span className="font-semibold text-[#2e1c12]">Total</span>
                  <strong
                    style={{
                      fontFamily: SERIF_FONT,
                      fontVariantNumeric: "lining-nums tabular-nums",
                    }}
                    className="text-2xl sm:text-[26px] font-normal text-[#2e1c12] tracking-tight"
                  >
                    {formatMoney(total)}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#f0e6da] flex items-center justify-center text-[#7a6252] mb-2.5">
                <ShoppingBag size={22} />
              </div>
              <p
                style={{ fontFamily: SANS_FONT }}
                className="font-medium text-sm text-[#3a2816]"
              >
                Your cart is empty
              </p>
              <p
                style={{ fontFamily: SANS_FONT }}
                className="text-[11px] sm:text-xs text-[#8a7261] mt-0.5 max-w-xs"
              >
                Discover pre-loved treasures in our thrift collection or explore live auctions.
              </p>
              <Button
                variant="outline"
                style={{ fontFamily: SANS_FONT }}
                className="mt-3.5 h-8 text-xs rounded-full border-[#5c3e29]/30 text-[#493022] hover:bg-[#ede3d4]"
                onClick={onClose}
              >
                Browse pieces
              </Button>
            </div>
          )}
        </DrawerBody>

        {cart.length > 0 && (
          <DrawerFooter
            style={{ fontFamily: SANS_FONT }}
            className="grid grid-cols-2 gap-2.5 border-t border-[#ebdcca] px-5 py-3.5 bg-[#FAF7F2]"
          >
            <Link
              href="#/cart"
              style={{ fontFamily: SANS_FONT }}
              className="inline-flex items-center justify-center rounded-xl border border-[#493022]/30 bg-transparent px-3 py-2.5 text-xs sm:text-sm font-semibold text-[#493022] hover:bg-[#ede3d4] transition-colors"
              onClick={onClose}
            >
              View cart
            </Link>
            <Link
              href="#/checkout"
              style={{
                fontFamily: SANS_FONT,
                background: "linear-gradient(145deg, #5c3b24 0%, #442a17 50%, #341f10 100%)",
                color: "#FAF7F2",
                boxShadow: "0 4px 14px rgba(52, 31, 16, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#301c0f] px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:brightness-110 transition-all cursor-pointer"
              onClick={onClose}
            >
              <LockKeyhole size={14} /> Checkout <ArrowRight size={14} />
            </Link>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
export default CartDrawer;
