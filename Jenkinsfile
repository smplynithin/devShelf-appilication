pipeline {
    agent { label 'devshelf-agent' }

    environment {
        ECR_REGISTRY   = '441384477695.dkr.ecr.us-east-1.amazonaws.com'
        IMAGE_TAG      = "${env.GIT_COMMIT.take(7)}"
        MANIFEST_REPO  = 'github.com/smplynithin/devshelf-manifests.git'
    }

    stages {

        // 1. Pull the exact commit that triggered this build
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        // 2. Install backend deps, run unit tests — fail fast if broken
        stage('Backend Test') {
            steps {
                dir('backend') {
                    sh 'pip3 install -r requirements.txt'
                    sh 'pytest --junitxml=test-results.xml'
                }
            }
            post {
                always {
                    junit 'backend/test-results.xml'
                }
            }
        }

        // 3. Build the React app — also catches JS/build errors early
        stage('Frontend Build') {
            steps {
                dir('frontend') {
                    sh 'npm install'
                    sh 'npm run build'
                }
            }
        }

        // 4. Send code to SonarQube for bugs, code smells, duplication
        stage('Code Quality - SonarQube') {
            steps {
                withSonarQubeEnv('sonarqube-server') {
                    sh '''
                        sonar-scanner \
                          -Dsonar.projectKey=devshelf \
                          -Dsonar.sources=backend/app,frontend/src
                    '''
                }
            }
        }

        // 5. Block the pipeline if SonarQube's quality gate fails
        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        // 6. Package the app into container images
        stage('Docker Build') {
            steps {
                sh "docker build -t ${ECR_REGISTRY}/devshelf-backend:${IMAGE_TAG} ./backend"
                sh "docker build -t ${ECR_REGISTRY}/devshelf-frontend:${IMAGE_TAG} ./frontend"
            }
        }

        // 7. Scan images — a HIGH/CRITICAL finding stops the pipeline here
        stage('Security Scan - Trivy') {
            steps {
                sh "trivy image --severity HIGH,CRITICAL --exit-code 1 ${ECR_REGISTRY}/devshelf-backend:${IMAGE_TAG}"
                sh "trivy image --severity HIGH,CRITICAL --exit-code 1 ${ECR_REGISTRY}/devshelf-frontend:${IMAGE_TAG}"
            }
        }

        // 8. Only scanned, tested, quality-checked images reach the registry
        stage('Push to ECR') {
            steps {
                sh "aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${ECR_REGISTRY}"
                sh "docker push ${ECR_REGISTRY}/devshelf-backend:${IMAGE_TAG}"
                sh "docker push ${ECR_REGISTRY}/devshelf-frontend:${IMAGE_TAG}"
            }
        }

        // 9. Jenkins does NOT deploy. It edits the staging manifest in git.
        //    ArgoCD is watching that repo and syncs the change automatically.
        stage('Update Staging Manifest') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-manifest-creds',
                    usernameVariable: 'GIT_USER',
                    passwordVariable: 'GIT_TOKEN'
                )]) {
                    sh '''
                        rm -rf manifests
                        git clone https://$GIT_USER:$GIT_TOKEN@$MANIFEST_REPO manifests
                        cd manifests/devshelf-chart
                        sed -i "s/tag:.*/tag: ${IMAGE_TAG}/" values-staging.yaml
                        git config user.email "jenkins@devshelf.local"
                        git config user.name "jenkins"
                        git commit -am "staging: bump image tag to ${IMAGE_TAG}"
                        git push
                    '''
                }
            }
        }

        // 10-12. DEFERRED TO PHASE 2 — these need a real EKS cluster with
        // ArgoCD running and actually syncing before they can succeed.
        // Uncomment once that's built.
        //
        // stage('Smoke Test - Staging') {
        //     steps {
        //         sh '''
        //             sleep 30
        //             curl -sf https://staging.devshelf.example.com/health
        //         '''
        //     }
        // }
        //
        // stage('Approval Gate - Production') {
        //     steps {
        //         timeout(time: 30, unit: 'MINUTES') {
        //             input message: 'Promote this build to production?', ok: 'Deploy'
        //         }
        //     }
        // }
        //
        // stage('Update Production Manifest') {
        //     steps {
        //         withCredentials([usernamePassword(
        //             credentialsId: 'github-manifest-creds',
        //             usernameVariable: 'GIT_USER',
        //             passwordVariable: 'GIT_TOKEN'
        //         )]) {
        //             sh '''
        //                 cd manifests/devshelf-chart
        //                 sed -i "s/tag:.*/tag: ${IMAGE_TAG}/" values-production.yaml
        //                 git commit -am "production: bump image tag to ${IMAGE_TAG}"
        //                 git push
        //             '''
        //         }
        //     }
        // }
    }

    post {
        success {
            echo "Build ${IMAGE_TAG} passed all gates and was promoted."
        }
        failure {
            echo "Pipeline failed — check which stage above stopped it."
        }
        always {
            sh 'docker system prune -f || true'
        }
    }
}
