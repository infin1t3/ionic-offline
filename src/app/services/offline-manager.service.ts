import {ToastController} from '@ionic/angular';
import {Injectable} from '@angular/core';
import {Storage} from '@ionic/storage';
import {HttpClient} from '@angular/common/http';
import {forkJoin, Observable, from, of} from 'rxjs';
import {switchMap, finalize} from 'rxjs/operators';

const STORAGE_REQ_KEY = 'storedreq';

interface StoredRequest {
  url: string;
  type: string;
  data: any;
  time: number;
  id: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineManagerService {

  constructor(
    private storage: Storage,
    private toastController: ToastController,
    private http: HttpClient
  ) {
  }

  checkForEvents(): Observable<any> {
    return from(this.storage.get(STORAGE_REQ_KEY)).pipe(
      switchMap(storedOperations => {
        const storedObj = JSON.parse(storedOperations);
        if (storedObj && storedObj.length > 0) {
          return this.sendRequests(storedObj).pipe(
            finalize(() => {
              const toast = this.toastController.create({
                message: `Local data succesfully synced to API!`,
                duration: 3000,
                position: 'bottom'
              });
              toast.then(resolvedToast => resolvedToast.present());
              this.storage.remove(STORAGE_REQ_KEY);
            })
          );
        } else {
          console.log('no local events');
          return of(false);
        }
      })
    );
  }

  storeRequest(url, type, data) {
    const toast = this.toastController.create({
      message: `Your data is stored locally because you seem to be offline.`,
      duration: 3000,
      position: 'bottom'
    });
    toast.then(resolvedToast => resolvedToast.present());

    const action: StoredRequest = {
      url,
      type,
      data,
      time: new Date().getTime(),
      id: Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5)
    };
    // https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript

    return this.storage.get(STORAGE_REQ_KEY).then(storedOperations => {
      let storedObj = JSON.parse(storedOperations);

      if (storedObj) {
        storedObj.push(action);
      } else {
        storedObj = [action];
      }

      console.log('local request stored: ', action);
      // Save old & new local transactions back to Storage
      return this.storage.set(STORAGE_REQ_KEY, JSON.stringify(storedObj));
    });
  }

  sendRequests(operations: StoredRequest[]) {
    const obs = [];

    for (const op of operations) {
      console.log('Make one request: ', op);
      const oneObs = this.http.request(op.type, op.url, op.data);
      obs.push(oneObs);
    }

    // Send out all local events and return once they are finished
    return forkJoin(obs);
  }
}
