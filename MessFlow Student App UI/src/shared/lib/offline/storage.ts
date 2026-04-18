import localforage from "localforage";

// Initialize localforage instances
const menuStore = localforage.createInstance({
  name: "messflow",
  storeName: "menu"
});

const userStore = localforage.createInstance({
  name: "messflow",
  storeName: "user"
});

const cartStore = localforage.createInstance({
  name: "messflow",
  storeName: "cart"
});

export const offlineStorage = {
  // --- Menu Cache ---
  async saveMenu(data: any) {
    return menuStore.setItem("latest_menu", data);
  },
  async getMenu() {
    return menuStore.getItem("latest_menu");
  },

  // --- User Profile / Balance Cache ---
  async saveProfile(profile: any) {
    return userStore.setItem("current_profile", profile);
  },
  async getProfile() {
    return userStore.getItem("current_profile");
  },

  // --- Cart Persistence ---
  async saveCart(cart: any[]) {
    return cartStore.setItem("active_cart", cart);
  },
  async getCart() {
    return cartStore.getItem<any[]>("active_cart");
  },
  async clearCart() {
    return cartStore.removeItem("active_cart");
  }
};
