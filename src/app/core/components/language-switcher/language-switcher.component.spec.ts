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
      ['setLanguage', 'getCurrentLanguage']
    );
    translationServiceSpy.currentLanguage$ = of('en' as any);
    translationServiceSpy.getCurrentLanguage.and.returnValue('en');

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

  it('should select language and close dropdown', () => {
    component.isDropdownOpen = true;
    component.selectLanguage('uk');
    expect(translationService.setLanguage).toHaveBeenCalledWith('uk');
    expect(component.isDropdownOpen).toBe(false);
  });

  it('should toggle dropdown', () => {
    expect(component.isDropdownOpen).toBe(false);
    component.toggleDropdown();
    expect(component.isDropdownOpen).toBe(true);
    component.toggleDropdown();
    expect(component.isDropdownOpen).toBe(false);
  });
});

