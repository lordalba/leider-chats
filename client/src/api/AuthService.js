const API_URL = 'http://localhost:3000/api/auth';

export async function registerUser(userData) {
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Registration failed');
    }
    return result;
  } catch (error) {
    throw new Error(error.message || 'Error occurred during registration');
  }
}

export async function loginUser(userData) {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Login failed');
    }
    return result; // Return the result (e.g., token)
  } catch (error) {
    throw new Error(error.message || 'Error occurred during login');
  }
}
