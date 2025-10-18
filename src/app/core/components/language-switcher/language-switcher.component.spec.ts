import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageSwitcherComponent } from './language-switcher.component';
import { TranslationService } from '../../services/translation.service';
import { of } from 'rxjs';

describe('LanguageSwitcherComponent', () => {
  let component: LanguageSwitcherComponent;
  let fixture: ComponentFixture<LanguageSwitcherComponent>;
  let translationService: jasmine.SpyObj<TranslationService>;

  beforeEach(async () => {
    const translationServiceSpy = jasmine.createSpyObj('TranslationService', 
      ['setLanguage', 'toggleLanguage', 'getCurrentLanguage']
    );
    translationServiceSpy.currentLanguage$ = of('en' as any);

    await TestBed.configureTestingModule({
      declarations: [ LanguageSwitcherComponent ],
      providers: [
        { provide: TranslationService, useValue: translationServiceSpy }
      ]
    })
    .compileComponents();

    translationService = TestBed.inject(TranslationService) as jasmine.SpyObj<TranslationService>;
    fixture = TestBed.createComponent(LanguageSwitcherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should switch language when button clicked', () => {
    component.switchLanguage('uk');
    expect(translationService.setLanguage).toHaveBeenCalledWith('uk');
  });

  it('should toggle language', () => {
    component.toggleLanguage();
    expect(translationService.toggleLanguage).toHaveBeenCalled();
  });
});

