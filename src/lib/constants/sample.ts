export const SAMPLE_TURTLE = `@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix ex:   <http://example.org/test#> .

### ONTOLOGY
<http://example.org/test> rdf:type owl:Ontology ;
    rdfs:label "Visualization Test Ontology" ;
    owl:versionInfo "1.0" .

### CLASSES
ex:Employee rdf:type owl:Class ;
    rdfs:label "Employee" .

ex:Department rdf:type owl:Class ;
    rdfs:label "Department" .

### PROPERTIES
ex:worksIn rdf:type owl:ObjectProperty ;
    rdfs:domain ex:Employee ;
    rdfs:range ex:Department ;
    rdfs:label "works in" .

ex:hasSalary rdf:type owl:DatatypeProperty ;
    rdfs:domain ex:Employee ;
    rdfs:range ex:SalaryInteger ;
    rdfs:label "has salary" .

ex:internalCode rdf:type owl:AnnotationProperty ;
    rdfs:label "internal legacy code" .

### DATATYPES
ex:SalaryInteger rdf:type rdfs:Datatype ;
    rdfs:label "Salary Integer Range" .

### INDIVIDUALS
ex:EngineeringDept rdf:type owl:NamedIndividual , ex:Department ;
    rdfs:label "Engineering Department" .

ex:AliceSmith rdf:type owl:NamedIndividual , ex:Employee ;
    rdfs:label "Alice Smith" ;
    ex:worksIn ex:EngineeringDept ;
    ex:hasSalary "85000"^^ex:SalaryInteger ;
    ex:internalCode "EMP-2026-09" .`;
