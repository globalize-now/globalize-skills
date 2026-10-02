import { createRouter, createWebHistory } from '@ionic/vue-router';
import CartPage from '../views/CartPage.vue';

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{ path: '/', redirect: '/cart' }, { path: '/cart', component: CartPage }],
});
