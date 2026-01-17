import { Injectable } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PageTitleService {
  private titleSubject = new BehaviorSubject<string>('');
  title$ = this.titleSubject.asObservable();

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.getDeepestTitle(this.activatedRoute))
    ).subscribe(title => {
      this.titleSubject.next(title);
    });
  }

  private getDeepestTitle(route: ActivatedRoute): string {
    let child = route;
    while (child.firstChild) {
      child = child.firstChild;
    }
    return child.snapshot.data['title'] || '';
  }

  setTitle(title: string): void {
    this.titleSubject.next(title);
  }

  getTitle(): string {
    return this.titleSubject.getValue();
  }
}
