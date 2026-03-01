import { AuthService, type AuthUser } from '../services/authService';

export type AuthMode = 'signin' | 'signup';

export class AuthModal {
  private modal: HTMLElement;
  private overlay: HTMLElement;
  private isOpen: boolean = false;
  private currentMode: AuthMode = 'signin';
  private onAuthChange: ((user: AuthUser | null) => void) | null = null;

  constructor() {
    this.createModal();
    this.setupEventListeners();
  }

  private createModal() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'auth-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: none;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(4px);
    `;

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'auth-modal';
    this.modal.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 32px;
      width: 400px;
      max-width: 90vw;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      position: relative;
    `;

    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);

    this.renderContent();
  }

  private renderContent() {
    const isSignIn = this.currentMode === 'signin';
    
    this.modal.innerHTML = `
      <div class="auth-header" style="margin-bottom: 24px; text-align: center;">
        <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">
          ${isSignIn ? 'Sign In' : 'Create Account'}
        </h2>
        <p style="margin: 0; color: #666; font-size: 14px;">
          ${isSignIn ? 'Welcome back to DingPlan' : 'Join DingPlan to save your projects'}
        </p>
      </div>

      <form class="auth-form" style="margin-bottom: 24px;">
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #333; margin-bottom: 6px;">
            Email Address
          </label>
          <input 
            type="email" 
            name="email" 
            required
            style="
              width: 100%;
              padding: 12px 16px;
              border: 1.5px solid #e1e5e9;
              border-radius: 8px;
              font-size: 16px;
              transition: border-color 0.2s ease;
              box-sizing: border-box;
              font-family: inherit;
            "
            placeholder="your@email.com"
          >
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #333; margin-bottom: 6px;">
            Password
          </label>
          <input 
            type="password" 
            name="password" 
            required
            style="
              width: 100%;
              padding: 12px 16px;
              border: 1.5px solid #e1e5e9;
              border-radius: 8px;
              font-size: 16px;
              transition: border-color 0.2s ease;
              box-sizing: border-box;
              font-family: inherit;
            "
            placeholder="Enter your password"
          >
        </div>

        <div class="auth-error" style="
          display: none;
          background: #fee;
          color: #c53030;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
          border: 1px solid #fecaca;
        "></div>

        <button 
          type="submit" 
          class="auth-submit"
          style="
            width: 100%;
            background: #2196F3;
            color: white;
            border: none;
            padding: 14px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s ease;
            font-family: inherit;
          "
        >
          ${isSignIn ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <div class="auth-toggle" style="text-align: center; margin-bottom: 20px;">
        <button 
          type="button"
          class="toggle-mode"
          style="
            background: none;
            border: none;
            color: #2196F3;
            font-size: 14px;
            cursor: pointer;
            text-decoration: underline;
            font-family: inherit;
          "
        >
          ${isSignIn ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>

      <button 
        class="auth-close" 
        style="
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          padding: 8px;
          line-height: 1;
          border-radius: 6px;
          transition: background-color 0.2s ease;
        "
        title="Close"
      >
        ×
      </button>
    `;

    // Add focus styles to inputs
    const inputs = this.modal.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        (input as HTMLElement).style.borderColor = '#2196F3';
        (input as HTMLElement).style.outline = 'none';
      });
      input.addEventListener('blur', () => {
        (input as HTMLElement).style.borderColor = '#e1e5e9';
      });
    });

    // Add hover style to submit button
    const submitBtn = this.modal.querySelector('.auth-submit') as HTMLElement;
    submitBtn.addEventListener('mouseenter', () => {
      submitBtn.style.backgroundColor = '#1976D2';
    });
    submitBtn.addEventListener('mouseleave', () => {
      submitBtn.style.backgroundColor = '#2196F3';
    });

    // Add hover style to close button
    const closeBtn = this.modal.querySelector('.auth-close') as HTMLElement;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.backgroundColor = 'transparent';
    });
  }

  private setupEventListeners() {
    // Close modal when clicking overlay
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Handle form submission and other events via event delegation
    this.modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.classList.contains('auth-close')) {
        this.close();
      } else if (target.classList.contains('toggle-mode')) {
        this.toggleMode();
      }
    });

    this.modal.addEventListener('submit', (e) => {
      if ((e.target as HTMLElement).classList.contains('auth-form')) {
        e.preventDefault();
        this.handleSubmit();
      }
    });

    // Handle escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  private toggleMode() {
    this.currentMode = this.currentMode === 'signin' ? 'signup' : 'signin';
    this.renderContent();
    this.clearError();
  }

  private async handleSubmit() {
    const form = this.modal.querySelector('.auth-form') as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    const submitBtn = this.modal.querySelector('.auth-submit') as HTMLButtonElement;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Loading...';
    submitBtn.disabled = true;

    try {
      let result;
      if (this.currentMode === 'signin') {
        result = await AuthService.signIn(email, password);
      } else {
        result = await AuthService.signUp(email, password);
      }

      if (result.error) {
        this.showError(result.error);
      } else if (result.user) {
        // Success
        this.close();
        if (this.onAuthChange) {
          this.onAuthChange(result.user);
        }
      }
    } catch (error) {
      this.showError('An unexpected error occurred. Please try again.');
      console.error('Auth error:', error);
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  private showError(message: string) {
    const errorEl = this.modal.querySelector('.auth-error') as HTMLElement;
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  private clearError() {
    const errorEl = this.modal.querySelector('.auth-error') as HTMLElement;
    errorEl.style.display = 'none';
  }

  public open(mode: AuthMode = 'signin') {
    this.currentMode = mode;
    this.renderContent();
    this.clearError();
    this.overlay.style.display = 'flex';
    this.isOpen = true;

    // Focus on email input
    setTimeout(() => {
      const emailInput = this.modal.querySelector('input[name="email"]') as HTMLInputElement;
      if (emailInput) {
        emailInput.focus();
      }
    }, 100);
  }

  public close() {
    this.overlay.style.display = 'none';
    this.isOpen = false;
    this.clearError();
  }

  public onAuthStateChange(callback: (user: AuthUser | null) => void) {
    this.onAuthChange = callback;
  }

  public destroy() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}