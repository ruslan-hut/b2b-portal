import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { LoginComponent } from './login.component';
import { SharedModule } from '../../shared/shared.module';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      // provideRouter also supplies the ActivatedRoute the component injects.
      imports: [SharedModule, RouterModule, ReactiveFormsModule, HttpClientTestingModule],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
