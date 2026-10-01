import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Navigate, Route } from 'react-router-dom';
import Cart from './pages/Cart';

setupIonicReact();

export default function App() {
  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route path="/cart" element={<Cart />} />
          <Route path="/" element={<Navigate to="/cart" replace />} />
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
}
