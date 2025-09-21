document
  .getElementById("isrc-form")
  .addEventListener("submit", function (event) {
    event.preventDefault();

    const action = event.submitter.value;

    if (action === "Post") {
      fetch(`/tidal/track`, {
        method: "POST",
	headers: {"Content-Type": "application/json"},
        body: JSON.stringify({isrc: document.getElementById("isrc").value})
      })
        .then((response) => response.json())
        .then((result) => console.log(result))
        .catch((err) => console.error(err));

      return;
    }

    const isrc = document.getElementById("isrc").value;
    fetch(`/tidal/track?isrc=${encodeURIComponent(isrc)}`)
      .then((response) => response.json())
      .then((data) => {
        console.log("Search results:", data);
        // Handle the search results as needed
      })
      .catch((error) => {
        console.error("Error fetching search results:", error);
      });
  });

document
  .getElementById("migrate-form")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const selectedOptions = Array.from(formData.entries()).map(
      (entry) => entry[0]
    );
    fetch("/migrate/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ options: selectedOptions })
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Migration result:", data);
        // Handle the migration result as needed
      })
      .catch((error) => {
        console.error("Error during migration:", error);
      });
  });
