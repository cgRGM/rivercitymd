"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  type: "service" | "addon";
  serviceId?: string;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: {
    name: string;
    price: number;
    type: "service" | "addon";
    serviceId?: string;
  }) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  cartTotal: number;
  getServiceIds: () => string[];
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (item: {
    name: string;
    price: number;
    type: "service" | "addon";
    serviceId?: string;
  }) => {
    const newItem: CartItem = {
      id: `${item.type}-${item.name}-${Date.now()}`,
      name: item.name,
      price: item.price,
      type: item.type,
      serviceId: item.serviceId,
    };
    setCart([...cart, newItem]);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  const getServiceIds = () => {
    return cart
      .filter((item) => item.type === "service" && item.serviceId)
      .map((item) => item.serviceId!)
      .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        cartTotal,
        getServiceIds,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
