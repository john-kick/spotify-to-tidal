(async () => {
  const [states, errors] = await checkLoginStatus();
  let ready = true;

  for (const service of ["spotify", "tidal"]) {
    const authElement = document.getElementById(service);
    const state = states.find((s) => s.service === service);
    const error = errors.find((e) => e.service === service);

    if (error) {
      console.error(`Error checking ${service} login status:`, error.error);
      const errTextElement = document.createElement("p");
      errTextElement.textContent = `An error occurred. Please try logging in again.`;
      authElement.appendChild(errTextElement);
      continue;
    }

    const actionContainer = authElement.querySelector(".action-container");
    if (state && state.authorized) {
      // Create a checkmark icon

      const checkmark = document.createElement("span");
      checkmark.className = "checkmark";
      actionContainer.appendChild(checkmark);

      checkmark.textContent = "✓";
      checkmark.style.fontSize = "48px";
      checkmark.style.color = "green";
    } else {
      // Login necessary
      ready = false;

      // Add the login button
      const loginLink = document.createElement("a");
      const loginButton = document.createElement("button");

      loginLink.appendChild(loginButton);
      actionContainer.appendChild(loginLink);

      loginLink.href = `/${service}/auth`;

      loginButton.id = `login-${service}`;
      const serviceUpper = service.charAt(0).toUpperCase() + service.slice(1);
      loginButton.textContent = `Log in to ${serviceUpper}`;
    }
  }

  if (!ready) {
    const continueButton = document.getElementById("btn-continue");
    continueButton.disabled = true;
    continueButton.classList.add("tooltip");
    const tooltip = document.createElement("div");
    continueButton.appendChild(tooltip);
    tooltip.className = "tooltiptext";
    tooltip.textContent = "Please log in to both services to continue.";
  }

  hydrate();
})();

function hydrate() {
  document.body.querySelector("main").hidden = "false";
}

async function checkLoginStatus() {
  const states = [];
  const errors = [];
  await fetch("/spotify/status")
    .then((response) => response.json())
    .then((data) => {
      states.push({ service: "spotify", authorized: data.authorized });
    })
    .catch((error) => {
      errors.push({ service: "spotify", error });
    });
  await fetch("/tidal/status")
    .then((response) => response.json())
    .then((data) => {
      states.push({ service: "tidal", authorized: data.authorized });
    })
    .catch((error) => {
      errors.push({ service: "tidal", error });
    });

  return [states, errors];
}
