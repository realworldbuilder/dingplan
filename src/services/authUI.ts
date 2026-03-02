import { authService } from './authService';
import { syncLocalToCloud } from './projectService';

export class AuthUI {
  private modal: HTMLElement;
  private form: HTMLFormElement;
  private emailInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private submitBtn: HTMLButtonElement;
  private googleBtn: HTMLButtonElement;
  private toggleBtn: HTMLButtonElement;
  private skipBtn: HTMLButtonElement;
  private errorDiv: HTMLElement;
  private title: HTMLElement;
  private subtitle: HTMLElement;
  private toggleText: HTMLElement;
  private userInfo: HTMLElement;
  private userEmail: HTMLElement;
  private signOutBtn: HTMLButtonElement;
  
  private isSignUp = false;

  constructor() {
    this.modal = document.getElementById('auth-modal')!;
    this.form = document.getElementById('auth-form') as HTMLFormElement;
    this.emailInput = document.getElementById('auth-email') as HTMLInputElement;
    this.passwordInput = document.getElementById('auth-password') as HTMLInputElement;
    this.submitBtn = document.getElementById('auth-submit') as HTMLButtonElement;
    this.googleBtn = document.getElementById('auth-google') as HTMLButtonElement;
    this.toggleBtn = document.getElementById('auth-toggle-btn') as HTMLButtonElement;
    this.skipBtn = document.getElementById('auth-skip-btn') as HTMLButtonElement;
    this.errorDiv = document.getElementById('auth-error')!;
    this.title = document.getElementById('auth-title')!;
    this.subtitle = document.getElementById('auth-subtitle')!;
    this.toggleText = document.getElementById('auth-toggle-text')!;
    this.userInfo = document.getElementById('user-info')!;
    this.userEmail = document.getElementById('user-email')!;
    this.signOutBtn = document.getElementById('sign-out-btn') as HTMLButtonElement;
    
    this.setupEventListeners();
    this.setupAuthStateListener();
  }

  private setupEventListeners() {
    // Form submission
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });

    // Toggle between sign in/up
    this.toggleBtn.addEventListener('click', () => {
      this.toggleMode();
    });

    // Google sign in
    this.googleBtn.addEventListener('click', async () => {
      await this.handleGoogleSignIn();
    });

    // Skip auth
    this.skipBtn.addEventListener('click', () => {
      localStorage.setItem('dingplan_skip_auth', 'true');
      this.hide();
    });

    // Sign out
    this.signOutBtn.addEventListener('click', async () => {
      await this.handleSignOut();
    });

    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    });
  }

  private setupAuthStateListener() {
    authService.onAuthStateChange((user) => {
      if (user) {
        this.showUserInfo(user.email);
        this.hide();
        // Sync local projects to cloud when user signs in
        syncLocalToCloud().catch(console.error);
      } else {
        this.hideUserInfo();
      }
    });
  }

  private async handleSubmit() {
    const email = this.emailInput.value.trim();
    const password = this.passwordInput.value;

    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    this.setLoading(true);
    this.hideError();

    try {
      let result;
      if (this.isSignUp) {
        result = await authService.signUp(email, password);
        if (result.user && !result.error) {
          this.showError('Account created! Please check your email to verify your account.', false);
          return;
        }
      } else {
        result = await authService.signIn(email, password);
      }

      if (result.error) {
        this.showError(result.error);
      } else {
        // Success is handled by auth state change listener
      }
    } catch (error) {
      this.showError('An unexpected error occurred');
      console.error('Auth error:', error);
    } finally {
      this.setLoading(false);
    }
  }

  private async handleGoogleSignIn() {
    this.setLoading(true);
    this.hideError();

    try {
      const { error } = await authService.signInWithGoogle();
      if (error) {
        this.showError(error);
      }
      // Success is handled by redirect
    } catch (error) {
      this.showError('Failed to sign in with Google');
      console.error('Google sign in error:', error);
    } finally {
      this.setLoading(false);
    }
  }

  private async handleSignOut() {
    try {
      const { error } = await authService.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }

  private toggleMode() {
    this.isSignUp = !this.isSignUp;
    this.updateUI();
    this.hideError();
  }

  private updateUI() {
    if (this.isSignUp) {
      this.title.textContent = 'Create Account';
      this.subtitle.textContent = 'Join DingPlan and save your projects';
      this.submitBtn.textContent = 'Sign Up';
      this.toggleText.textContent = 'Already have an account?';
      this.toggleBtn.textContent = 'Sign in';
    } else {
      this.title.textContent = 'Welcome Back';
      this.subtitle.textContent = 'Sign in to access your projects';
      this.submitBtn.textContent = 'Sign In';
      this.toggleText.textContent = "Don't have an account?";
      this.toggleBtn.textContent = 'Sign up';
    }
  }

  private setLoading(loading: boolean) {
    this.submitBtn.disabled = loading;
    this.googleBtn.disabled = loading;
    this.emailInput.disabled = loading;
    this.passwordInput.disabled = loading;
    
    if (loading) {
      this.submitBtn.textContent = 'Loading...';
    } else {
      this.updateUI();
    }
  }

  private showError(message: string, isError = true) {
    this.errorDiv.textContent = message;
    this.errorDiv.style.display = 'block';
    this.errorDiv.style.backgroundColor = isError ? '#ff4444' : '#00aa44';
  }

  private hideError() {
    this.errorDiv.style.display = 'none';
  }

  private showUserInfo(email: string) {
    this.userEmail.textContent = email;
    this.userInfo.classList.add('show');
  }

  private hideUserInfo() {
    this.userInfo.classList.remove('show');
  }

  show() {
    this.modal.classList.add('show');
    this.emailInput.focus();
  }

  hide() {
    this.modal.classList.remove('show');
    this.form.reset();
    this.hideError();
    this.setLoading(false);
  }

  isVisible() {
    return this.modal.classList.contains('show');
  }
}

// Create global instance
export const authUI = new AuthUI();