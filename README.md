# JYDB Movie Database - Backend Database and API

**JYDB Movie Database** was developed by Jamie Cook and Ylva Nilsson for the final project of the Technigo boot-camp.

For our Movie Database Backend we created a **RESTful API** using Express on **Node.js**. We store our data using **MongoDB** and **Mongoose**. It has been deployed to **Heroku** and **MongoDB Atlas**. We created 3 collections for our database: **user** **rating** and **watchMovie**. And have implemented validation where possible to control the data stored in our database.

**Base URL**
https://final-project-moviedb.herokuapp.com/

_Registration endpoint_: can only be accessed after the user has successfully signed up or logged in.

**GET /**
_Root endpoint_: Shows a list of available endpoints.

**POST /users**
_Registration endpoint_: This endpoint creates a new user. It expects a username, email address and password in the clients POST request body.

**POST /sessions**
_Login endpoint_: Login for existing users. This endpoint expects username and password in the request body.

**PUT /users/:userId/watchlist**
_Restricted endpoint_: The endpoint first checks to see if userId and movieId already exist (if the user has liked the movie before) and toggles if so. Otherwise it will just create a new document. It expects movieId and watchlist (boolean value) in the request body with the userId as a param.

**GET /users/:userId/watchlist**
_Restricted endpoint_: This endpoint returns movies with a watchlist: true value for a specific userId. userId needs to be provided as a param.

**POST /comments/:movieId**
_Restricted endpoint_: This adds a comment to a specific movie. The endpoint expects a movieId as a param and userId, comment and username in the request body.

**GET /comments/:movieId**
_Comments endpoint_: Endpoint to return all comments for a specific movie. A movieId as a param is required.

**DELETE /comments/:movieId**
_Restricted endpoint_: Endpoint to delete a specific movie comment/review. It expects the movieId as a param as well as a userId and commentId in the request body.

## View the Frontend

Repository: https://github.com/the-j-curl/project-final-movie-frontend
Live site: https://jydb-movies.netlify.app/
