import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { LoginRequest, LoginResponse, User } from '../models/user.model';
import { MOCK_USERS } from '../mock-data/users.mock';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  constructor() {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    // TODO: Replace with actual API call
    // Mock authentication: find user by email
    const user = MOCK_USERS.find(u => u.email === credentials.email);
    
    if (!user) {
      // Simulate authentication failure
      return throwError(() => new Error('Invalid credentials')).pipe(delay(500));
    }

    const mockResponse: LoginResponse = {
      token: 'mock-jwt-token-' + new Date().getTime(),
      user: user
    };

    // Simulate API delay
    return of(mockResponse).pipe(delay(500));
  }

  logout(): void {
    // TODO: Call API to invalidate token
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    this.currentUserSubject.next(null);
  }

  setAuthData(response: LoginResponse): void {
    localStorage.setItem('currentUser', JSON.stringify(response.user));
    localStorage.setItem('authToken', response.token);
    this.currentUserSubject.next(response.user);
  }

  isAuthenticated(): boolean {
    return !!this.currentUserValue && !!localStorage.getItem('authToken');
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }
}
