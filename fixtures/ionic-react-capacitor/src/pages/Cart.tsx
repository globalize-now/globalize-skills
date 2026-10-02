import { IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToolbar, useIonAlert, useIonToast } from '@ionic/react';
import { useState } from 'react';

const initial = [
  { name: 'Ceramic mug', price: 12.5, qty: 2 },
  { name: 'Linen towel', price: 18, qty: 1 },
];

export default function Cart() {
  const [lines, setLines] = useState(initial);
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

  const remove = (name: string) =>
    presentAlert({
      header: 'Remove item?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Remove', role: 'destructive', handler: () => { setLines(lines.filter((l) => l.name !== name)); presentToast({ message: 'Item removed', duration: 1500 }); } },
      ],
    });

  return (
    <IonPage>
      <IonHeader><IonToolbar><IonTitle>Your cart</IonTitle></IonToolbar></IonHeader>
      <IonContent>
        <IonList>
          {lines.map((l) => (
            <IonItem key={l.name}>
              <IonLabel>{l.name} — ${l.price.toFixed(2)}</IonLabel>
              <IonButton fill="clear" onClick={() => remove(l.name)}>Remove</IonButton>
            </IonItem>
          ))}
        </IonList>
        <p>Total: ${total.toFixed(2)}</p>
        <IonButton expand="block">Check out</IonButton>
      </IonContent>
    </IonPage>
  );
}
