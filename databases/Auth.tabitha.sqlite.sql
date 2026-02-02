CREATE TABLE Permissions (
			id				INTEGER PRIMARY KEY,
			app			TEXT,
			permission	TEXT
		);
INSERT INTO Permissions VALUES(1,'ontology','PROTECTED_ACCESS');
INSERT INTO Permissions VALUES(2,'ontology','ADD_CONCEPT');
INSERT INTO Permissions VALUES(3,'ontology','UPDATE_CONCEPT');
INSERT INTO Permissions VALUES(4,'ontology','DELETE_CONCEPT');
CREATE TABLE User_Permissions (
			user_email	TEXT,
			permission_id	INTEGER
		);
CREATE TABLE Users (
			email		TEXT PRIMARY KEY,
			name		TEXT
		);
