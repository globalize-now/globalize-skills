import { Component, inject } from '@angular/core';
import {
  AlertController, ToastController, IonBackButton, IonButton, IonButtons, IonContent,
  IonHeader, IonItem, IonLabel, IonList, IonTitle, IonToolbar,
} from '@ionic/angular';

interface CartLine { name: string; price: number; qty: number }

@Component({
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  imports: [IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonTitle, IonToolbar],
})
export class CartPage {
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  lines: CartLine[] = [
    { name: 'Ceramic mug', price: 12.5, qty: 2 },
    { name: 'Linen towel', price: 18, qty: 1 },
  ];

  get total(): number { return this.lines.reduce((sum, l) => sum + l.price * l.qty, 0); }
  get itemCount(): number { return this.lines.reduce((sum, l) => sum + l.qty, 0); }

  formatPrice(value: number): string { return '$' + value.toFixed(2); }

  async remove(line: CartLine) {
    const alert = await this.alertCtrl.create({
      header: 'Remove item?',
      message: `Remove ${line.name} from your cart?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Remove', role: 'destructive', handler: () => this.drop(line) },
      ],
    });
    await alert.present();
  }

  private async drop(line: CartLine) {
    this.lines = this.lines.filter((l) => l !== line);
    const toast = await this.toastCtrl.create({ message: 'Item removed', duration: 1500 });
    await toast.present();
  }
}
