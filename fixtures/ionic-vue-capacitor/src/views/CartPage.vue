<script setup lang="ts">
import { IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToolbar, alertController, toastController } from '@ionic/vue';
import { computed, ref } from 'vue';

const lines = ref([
  { name: 'Ceramic mug', price: 12.5, qty: 2 },
  { name: 'Linen towel', price: 18, qty: 1 },
]);
const total = computed(() => lines.value.reduce((sum, l) => sum + l.price * l.qty, 0));

async function remove(name: string) {
  const alert = await alertController.create({
    header: 'Remove item?',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Remove', role: 'destructive', handler: async () => {
        lines.value = lines.value.filter((l) => l.name !== name);
        (await toastController.create({ message: 'Item removed', duration: 1500 })).present();
      } },
    ],
  });
  await alert.present();
}
</script>

<template>
  <ion-page>
    <ion-header><ion-toolbar><ion-title>Your cart</ion-title></ion-toolbar></ion-header>
    <ion-content>
      <ion-list>
        <ion-item v-for="l in lines" :key="l.name">
          <ion-label>{{ l.name }} — ${{ l.price.toFixed(2) }}</ion-label>
          <ion-button fill="clear" @click="remove(l.name)">Remove</ion-button>
        </ion-item>
      </ion-list>
      <p>Total: ${{ total.toFixed(2) }}</p>
      <ion-button expand="block">Check out</ion-button>
    </ion-content>
  </ion-page>
</template>
